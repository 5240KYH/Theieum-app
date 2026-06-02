package com.theieum.approval.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByLoginIdAndActiveTrue(String loginId);

    Optional<User> findByIdAndActiveTrue(Long id);
}
