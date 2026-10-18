package com.cube.lab.repository;

import com.cube.lab.entity.Music;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MusicRepository extends JpaRepository<Music, Long> {

    /** 曲库列表：按排序权重降序，再按创建时间升序 */
    List<Music> findAllByOrderBySortOrderDescCreatedAtAsc();
}
