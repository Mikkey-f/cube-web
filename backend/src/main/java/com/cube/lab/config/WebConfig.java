package com.cube.lab.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 音乐文件静态直出。
 * <p>
 * 生产环境由 nginx 的 {@code location /music/} 直接服务（Range 请求、缓存都由 nginx 负责），
 * 这个映射是为了**本地开发**：没有 nginx 时 /music/xxx.mp3 也能通过 vite 代理拿到，
 * 否则封面、歌词、音频全部 404，本地根本看不出播放器效果。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final Path musicDir;

    public WebConfig(@Value("${app.music-dir:./music}") String musicDir) {
        this.musicDir = Paths.get(musicDir).toAbsolutePath().normalize();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // ResourceLocation 必须以 / 结尾，否则会被当成单个文件路径
        String location = musicDir.toUri().toString();
        if (!location.endsWith("/")) {
            location = location + "/";
        }
        registry.addResourceHandler("/music/**")
                .addResourceLocations(location)
                .setCachePeriod(86400);
    }
}
