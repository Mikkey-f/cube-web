package com.cube.lab.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 留言祝福墙：访客提交的一句话留言。
 * 默认未审核，管理员通过后才会出现在首页跑马灯。
 */
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 昵称，可空，空则展示为「匿名」 */
    @Column(length = 32)
    private String nickname;

    @Column(nullable = false, length = 140)
    private String content;

    @Column(nullable = false)
    private boolean approved = false;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isApproved() {
        return approved;
    }

    public void setApproved(boolean approved) {
        this.approved = approved;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
