package com.cube.lab.config;

import com.cube.lab.entity.Music;
import com.cube.lab.repository.MusicRepository;
import com.cube.lab.util.CoverImageProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

/**
 * 启动时把「历史遗留的大体积封面」重编码一次，让老曲目也享受到上传时的压缩策略。
 *
 * <p>幂等性来自处理条件本身：压完的封面（≤640px 且 ≤200KB）下次启动不会再被判定为需要优化，
 * 因此不存在反复转码导致的画质累积劣化。
 *
 * <p>安全边界：
 * <ul>
 *   <li>单条失败只记日志，绝不阻断启动，也不影响其它曲目</li>
 *   <li>替换前把原图备份到 {@code <music-dir>-orig}（在 nginx 的 /music/ 目录之外，不会被外部访问）</li>
 *   <li>压缩结果不比原图小就放弃（由 {@link CoverImageProcessor} 保证）</li>
 * </ul>
 */
@Component
public class CoverMigrationRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CoverMigrationRunner.class);

    private final MusicRepository musicRepository;
    private final Path musicDir;
    private final Path backupDir;

    public CoverMigrationRunner(MusicRepository musicRepository,
                                @Value("${app.music-dir:./music}") String musicDir) {
        this.musicRepository = musicRepository;
        this.musicDir = Paths.get(musicDir).toAbsolutePath().normalize();
        this.backupDir = this.musicDir.resolveSibling(this.musicDir.getFileName() + "-orig");
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!Files.isDirectory(musicDir)) return;
        List<Music> all = musicRepository.findAll();
        int done = 0;
        long savedBytes = 0;

        for (Music m : all) {
            String name = m.getCoverFilename();
            if (name == null || name.isBlank()) continue;
            Path file = musicDir.resolve(name).normalize();
            if (!file.startsWith(musicDir) || !Files.isRegularFile(file)) continue;

            try {
                byte[] raw = Files.readAllBytes(file);
                CoverImageProcessor.Result result = CoverImageProcessor.process(raw);
                if (result == null) continue;

                String newName = UUID.randomUUID() + "." + result.ext();
                Path target = musicDir.resolve(newName);

                // 先备份原图，再落新图、更新记录、删旧图：任一步失败都不会丢数据
                Files.createDirectories(backupDir);
                Files.copy(file, backupDir.resolve(name), StandardCopyOption.REPLACE_EXISTING);
                Files.write(target, result.data());

                m.setCoverFilename(newName);
                musicRepository.save(m);
                Files.deleteIfExists(file);

                done++;
                savedBytes += (raw.length - result.data().length);
                log.info("封面已优化: {} {}KB -> {}KB", name, raw.length / 1024, result.data().length / 1024);
            } catch (Exception e) {
                log.warn("封面优化失败，已保留原图: {}", name, e);
            }
        }

        if (done > 0) {
            log.info("封面优化完成：{} 张，共节省 {}KB", done, savedBytes / 1024);
        }
    }
}
