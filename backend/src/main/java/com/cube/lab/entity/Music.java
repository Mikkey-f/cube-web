package com.cube.lab.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 首页背景音乐曲目。MP3 文件存服务器硬盘（nginx 静态服务），
 * 数据库只存元数据与存储文件名。
 */
@Entity
@Table(name = "musics")
public class Music {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 显示标题（用户可见） */
    @Column(nullable = false, length = 64)
    private String title;

    /** 存储文件名（UUID.mp3） */
    @Column(nullable = false)
    private String filename;

    /** 原始文件名（上传时） */
    @Column(nullable = false)
    private String originalName;

    /** 文件大小（字节） */
    @Column(nullable = false)
    private long size;

    /** 封面图存储文件名（可选，UUID.jpg/png） */
    @Column(nullable = true)
    private String coverFilename;

    /** 歌词存储文件名（可选，UUID.lrc） */
    @Column(nullable = true)
    private String lyricsFilename;

    /** 排序权重，越大越靠前 */
    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getOriginalName() {
        return originalName;
    }

    public void setOriginalName(String originalName) {
        this.originalName = originalName;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getCoverFilename() {
        return coverFilename;
    }

    public void setCoverFilename(String coverFilename) {
        this.coverFilename = coverFilename;
    }

    public String getLyricsFilename() {
        return lyricsFilename;
    }

    public void setLyricsFilename(String lyricsFilename) {
        this.lyricsFilename = lyricsFilename;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
