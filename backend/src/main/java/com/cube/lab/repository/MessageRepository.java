package com.cube.lab.repository;

import com.cube.lab.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    /** 首页跑马灯：已审核留言，最新在前，最多取 100 条 */
    List<Message> findTop100ByApprovedTrueOrderByCreatedAtDesc();

    /** 管理后台：全部留言，最新在前 */
    List<Message> findAllByOrderByCreatedAtDesc();
}
