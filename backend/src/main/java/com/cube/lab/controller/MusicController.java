package com.cube.lab.controller;

import com.cube.lab.entity.Music;
import com.cube.lab.repository.MusicRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 首页背景音乐接口。
 * 公开：拉取曲目元数据（含播放 URL，MP3 由 nginx 静态服务，不走本服务）。
 * 管理：上传（管理员）、删除。
 */
@RestController
@RequestMapping("/api")
public class MusicController {

    private static final Logger log = LoggerFactory.getLogger(MusicController.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    /** 单曲上限 15MB，总配额靠管理端自行控制 */
    private static final long MAX_MUSIC_SIZE = 15L * 1024 * 1024;

    public record MusicResponse(Long id, String title, String url, long size, String createdAt) {
        static MusicResponse from(Music m) {
            return new MusicResponse(
                    m.getId(),
                    m.getTitle(),
                    "/music/" + m.getFilename(),
                    m.getSize(),
                    m.getCreatedAt().format(FMT));
        }
    }

    private final MusicRepository musicRepository;
    private final Path musicDir;

    public MusicController(MusicRepository musicRepository,
                           @Value("${app.music-dir:./music}") String musicDir) throws IOException {
        this.musicRepository = musicRepository;
        this.musicDir = Paths.get(musicDir).toAbsolutePath().normalize();
        Files.createDirectories(this.musicDir);
    }

    /** 公开曲目列表：给首页播放器用 */
    @GetMapping("/music")
    public List<MusicResponse> list() {
        return musicRepository.findAllByOrderBySortOrderDescCreatedAtAsc().stream()
                .map(MusicResponse::from)
                .toList();
    }

    /** 管理员上传 MP3 */
    @PostMapping(value = "/admin/music", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MusicResponse> upload(
            @RequestParam @NotBlank(message = "标题不能为空") @Size(max = 64) String title,
            @RequestPart("file") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择 MP3 文件");
        }
        if (file.getSize() > MAX_MUSIC_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "单曲不能超过 15MB");
        }
        String name = file.getOriginalFilename();
        String contentType = file.getContentType();
        boolean mp3ByName = name != null && name.toLowerCase().endsWith(".mp3");
        boolean mp3ByType = "audio/mpeg".equals(contentType);
        if (!mp3ByName && !mp3ByType) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只支持 MP3 格式");
        }

        String stored = UUID.randomUUID() + ".mp3";
        Files.write(musicDir.resolve(stored), file.getBytes());

        Music m = new Music();
        m.setTitle(title.trim());
        m.setFilename(stored);
        m.setOriginalName(name == null ? "music.mp3" : name);
        m.setSize(file.getSize());
        m.setSortOrder(0);
        musicRepository.save(m);

        return ResponseEntity.status(HttpStatus.CREATED).body(MusicResponse.from(m));
    }

    /** 管理员删除曲目，文件一并清除 */
    @DeleteMapping("/admin/music/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Music m = musicRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "曲目不存在"));
        musicRepository.delete(m);
        Path file = musicDir.resolve(m.getFilename()).normalize();
        if (file.startsWith(musicDir)) {
            try {
                Files.deleteIfExists(file);
            } catch (IOException e) {
                log.warn("音乐文件删除失败: {}", file, e);
            }
        }
        return ResponseEntity.noContent().build();
    }
}
