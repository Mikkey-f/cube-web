package com.cube.lab.controller;

import com.cube.lab.entity.Message;
import com.cube.lab.repository.MessageRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 留言祝福墙接口。
 * 公开：提交留言（先审后发）、拉取已审核留言；管理：审核 / 下架 / 删除。
 * 公开提交带简单的内存 IP 限流（每分钟 5 条），不建表、不加中间件。
 */
@RestController
@RequestMapping("/api")
public class MessageController {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    /** 每个 IP 每分钟最多提交的留言数 */
    private static final int RATE_LIMIT = 5;
    private static final long RATE_WINDOW_MS = 60_000;

    public record SubmitMessage(
            @Size(max = 32, message = "昵称最多 32 个字") String nickname,
            @NotBlank(message = "留言不能为空") @Size(max = 140, message = "留言最多 140 个字") String content) {
    }

    public record MessageResponse(Long id, String nickname, String content, boolean approved, String createdAt) {
        static MessageResponse from(Message m) {
            String nick = m.getNickname() == null || m.getNickname().isBlank() ? "匿名" : m.getNickname();
            return new MessageResponse(m.getId(), nick, m.getContent(), m.isApproved(), m.getCreatedAt().format(FMT));
        }
    }

    private final MessageRepository messageRepository;
    /** IP → 最近提交时间戳（滑动窗口）。单机内存实现，重启即清零，够用 */
    private final Map<String, ConcurrentLinkedDeque<Long>> submitLog = new ConcurrentHashMap<>();

    public MessageController(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    /** 访客提交留言：默认未审核，不进首页 */
    @PostMapping("/messages")
    public ResponseEntity<Map<String, String>> submit(@RequestBody SubmitMessage body, HttpServletRequest request) {
        String ip = clientIp(request);
        long now = System.currentTimeMillis();
        var log = submitLog.computeIfAbsent(ip, k -> new ConcurrentLinkedDeque<>());
        while (true) {
            Long head = log.peekFirst();
            if (head == null || now - head < RATE_WINDOW_MS) break;
            log.pollFirst();
        }
        if (log.size() >= RATE_LIMIT) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "提交太频繁了，休息一下再来");
        }
        log.addLast(now);

        Message m = new Message();
        m.setNickname(body.nickname() == null ? "" : body.nickname().trim());
        m.setContent(body.content().trim());
        messageRepository.save(m);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "已提交，审核通过后就会出现在祝福墙上"));
    }

    /** 首页跑马灯：只返回已审核留言 */
    @GetMapping("/messages/approved")
    public List<MessageResponse> approved() {
        return messageRepository.findTop100ByApprovedTrueOrderByCreatedAtDesc().stream()
                .map(MessageResponse::from)
                .toList();
    }

    /** 管理员查看全部留言（含待审核） */
    @GetMapping("/admin/messages")
    public List<MessageResponse> listAll() {
        return messageRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(MessageResponse::from)
                .toList();
    }

    /** 管理员审核 / 下架留言 */
    public record ReviewMessage(boolean approved) {
    }

    @PutMapping("/admin/messages/{id}")
    public MessageResponse review(@PathVariable Long id, @RequestBody ReviewMessage body) {
        Message m = messageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "留言不存在"));
        m.setApproved(body.approved());
        messageRepository.save(m);
        return MessageResponse.from(m);
    }

    /** 管理员删除留言 */
    @DeleteMapping("/admin/messages/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!messageRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "留言不存在");
        }
        messageRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
