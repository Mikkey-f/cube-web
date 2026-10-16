package com.cube.lab.controller;

import com.cube.lab.entity.Application;
import com.cube.lab.entity.User;
import com.cube.lab.repository.ApplicationRepository;
import com.cube.lab.repository.UserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ApplicationController {

    private static final Logger log = LoggerFactory.getLogger(ApplicationController.class);

    private static final long MAX_RESUME_SIZE = 20L * 1024 * 1024;

    public record ApplicationResponse(
            Long id,
            String username,
            String realName,
            String studentId,
            String phone,
            String direction,
            String intro,
            String resumeOriginalName,
            String createdAt) {

        static ApplicationResponse from(Application a) {
            return new ApplicationResponse(
                    a.getId(),
                    a.getUser().getUsername(),
                    a.getRealName(),
                    a.getStudentId(),
                    a.getPhone(),
                    a.getDirection(),
                    a.getIntro(),
                    a.getResumeOriginalName(),
                    a.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        }
    }

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final Path uploadDir;

    public ApplicationController(ApplicationRepository applicationRepository,
                                 UserRepository userRepository,
                                 @Value("${app.upload-dir}") String uploadDir) throws IOException {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    private User currentUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户不存在"));
    }

    /** 普通用户提交报名（每人一次） */
    @PostMapping(value = "/applications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApplicationResponse> submit(
            Authentication auth,
            @RequestParam @NotBlank(message = "姓名不能为空") @Size(max = 64) String realName,
            @RequestParam(required = false) @Size(max = 64) String studentId,
            @RequestParam(required = false) @Size(max = 32) String phone,
            @RequestParam(required = false) @Size(max = 64) String direction,
            @RequestParam(required = false) @Size(max = 2000) String intro,
            @RequestPart("resume") MultipartFile resume) throws IOException {

        User user = currentUser(auth);
        if (applicationRepository.existsByUser(user)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "你已提交过报名，请勿重复提交");
        }
        validateResume(resume);

        String storedName = UUID.randomUUID() + ".pdf";
        Files.write(uploadDir.resolve(storedName), resume.getBytes());

        Application app = new Application();
        app.setUser(user);
        app.setRealName(realName);
        app.setStudentId(studentId);
        app.setPhone(phone);
        // 意向方向已从报名表中移除，保留字段兼容历史数据，统一写空串
        app.setDirection(direction == null || direction.isBlank() ? "" : direction);
        app.setIntro(intro);
        app.setResumeFilename(storedName);
        app.setResumeOriginalName(resume.getOriginalFilename() == null ? "resume.pdf" : resume.getOriginalFilename());
        applicationRepository.save(app);

        return ResponseEntity.status(HttpStatus.CREATED).body(ApplicationResponse.from(app));
    }

    /** 普通用户查看自己的报名 */
    @GetMapping("/applications/me")
    @Transactional(readOnly = true)
    public ResponseEntity<ApplicationResponse> myApplication(Authentication auth) {
        User user = currentUser(auth);
        return applicationRepository.findByUser(user)
                .map(a -> ResponseEntity.ok(ApplicationResponse.from(a)))
                .orElse(ResponseEntity.noContent().build());
    }

    /** 管理员查看所有投递 */
    @GetMapping("/admin/applications")
    @Transactional(readOnly = true)
    public List<ApplicationResponse> listAll() {
        return applicationRepository.findAllWithUser().stream()
                .map(ApplicationResponse::from)
                .toList();
    }

    /** 管理员下载简历 */
    @GetMapping("/admin/applications/{id}/resume")
    public ResponseEntity<Resource> downloadResume(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "报名记录不存在"));
        Path file = uploadDir.resolve(app.getResumeFilename()).normalize();
        if (!file.startsWith(uploadDir) || !Files.exists(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "简历文件不存在");
        }
        String encoded = URLEncoder.encode(app.getResumeOriginalName(), StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(new FileSystemResource(file));
    }

    /** 管理员删除投递，简历文件一并清除 */
    @DeleteMapping("/admin/applications/{id}")
    @Transactional
    public ResponseEntity<Void> deleteApplication(@PathVariable Long id) {
        Application app = applicationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "报名记录不存在"));
        applicationRepository.delete(app);
        Path file = uploadDir.resolve(app.getResumeFilename()).normalize();
        if (file.startsWith(uploadDir)) {
            try {
                Files.deleteIfExists(file);
            } catch (IOException e) {
                // 记录已删，文件残留不影响业务，仅告警便于手工清理
                log.warn("简历文件删除失败: {}", file, e);
            }
        }
        return ResponseEntity.noContent().build();
    }

    private void validateResume(MultipartFile resume) {
        if (resume.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请上传 PDF 简历");
        }
        if (resume.getSize() > MAX_RESUME_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "简历文件不能超过 20MB");
        }
        String name = resume.getOriginalFilename();
        String contentType = resume.getContentType();
        boolean pdfByName = name != null && name.toLowerCase().endsWith(".pdf");
        boolean pdfByType = MediaType.APPLICATION_PDF_VALUE.equals(contentType);
        if (!pdfByName && !pdfByType) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只支持 PDF 格式的简历");
        }
    }
}
