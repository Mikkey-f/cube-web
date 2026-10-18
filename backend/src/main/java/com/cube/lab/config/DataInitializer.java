package com.cube.lab.config;

import com.cube.lab.entity.Role;
import com.cube.lab.entity.User;
import com.cube.lab.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 启动时保证管理员账号存在且密码固定、不可改。
 * <p>
 * 需求：管理员账号固定为 {@code admin}，密码固定且任何情况下不允许修改。
 * 实现：用户名写死在代码里；密码<b>从配置读</b>（不进公开仓库），启动时每次<b>强制复位</b>
 * 该账号的密码与角色——即使有人在库里改了密码/角色，重启即纠正。
 * 密码必须配置：留空或缺失会直接抛异常，杜绝无密码裸奔。
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    /** 固定管理员用户名（写死，不允许修改） */
    private static final String ADMIN_USERNAME = "admin";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminPassword;

    public DataInitializer(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           @Value("${app.admin.password:}") String adminPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(String... args) {
        if (adminPassword == null || adminPassword.isBlank()) {
            throw new IllegalStateException(
                    "未配置管理员密码 app.admin.password —— 固定管理员账号必须显式提供密码（见 application-example.yml）");
        }

        Optional<User> existing = userRepository.findByUsername(ADMIN_USERNAME);
        if (existing.isEmpty()) {
            User admin = new User(ADMIN_USERNAME, passwordEncoder.encode(adminPassword), Role.ADMIN);
            userRepository.save(admin);
            log.info("已创建固定管理员账号: {}（密码由配置注入，不可改）", ADMIN_USERNAME);
            return;
        }

        // 账号已存在：强制复位角色与密码为配置值，杜绝任何被改动后的残留
        User admin = existing.get();
        boolean changed = false;
        if (!Role.ADMIN.equals(admin.getRole())) {
            admin.setRole(Role.ADMIN);
            changed = true;
        }
        if (!passwordEncoder.matches(adminPassword, admin.getPassword())) {
            admin.setPassword(passwordEncoder.encode(adminPassword));
            changed = true;
        }
        if (changed) {
            userRepository.save(admin);
            log.info("已复位固定管理员账号 {} 的角色与密码（不可改）", ADMIN_USERNAME);
        }
    }
}
