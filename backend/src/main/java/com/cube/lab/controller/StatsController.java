package com.cube.lab.controller;

import com.cube.lab.repository.ApplicationRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 公开统计接口：给首页「招新实时战报」用。
 * 只暴露聚合数字，不涉及任何个人信息，因此无需登录。
 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    public record RecruitStats(long count) {}

    private final ApplicationRepository applicationRepository;

    public StatsController(ApplicationRepository applicationRepository) {
        this.applicationRepository = applicationRepository;
    }

    /** 累计收到的报名（简历）份数 */
    @GetMapping("/recruit")
    public RecruitStats recruit() {
        return new RecruitStats(applicationRepository.count());
    }
}
