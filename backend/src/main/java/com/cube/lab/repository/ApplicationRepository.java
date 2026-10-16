package com.cube.lab.repository;

import com.cube.lab.entity.Application;
import com.cube.lab.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    Optional<Application> findByUser(User user);

    boolean existsByUser(User user);

    /** 一次性抓取关联用户，避免懒加载异常 */
    @Query("select a from Application a join fetch a.user order by a.createdAt desc")
    List<Application> findAllWithUser();
}
