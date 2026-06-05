insert into positions (id, name, rank_order, sort_order, active) values
    (1, '사원', 10, 10, true),
    (2, '대리', 20, 20, true),
    (3, '과장', 30, 30, true),
    (4, '팀장', 40, 40, true),
    (5, '대표', 50, 50, true);

insert into organizations (id, name, parent_id, level_no, sort_order, active) values
    (1, '더이음', null, 1, 10, true),
    (2, '경영지원팀', 1, 2, 20, true),
    (3, '개발팀', 1, 2, 30, true),
    (4, '영업팀', 1, 2, 40, true);

insert into approval_types (id, name, description, active) values
    (1, '영수증 첨부 신청', '영수증 이미지를 첨부해 비용 사용 내역을 결재 요청하는 기본 신청 유형', true);

insert into users (
    id,
    login_id,
    external_subject,
    password_hash,
    name,
    email,
    organization_id,
    position_id,
    roles,
    active
) values
    (1, 'admin', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '관리자', 'admin@theieum.local', 1, 5, 'ADMIN,APPROVER,APPLICANT', true),
    (2, 'approver01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '결재자01', 'approver01@theieum.local', 2, 4, 'APPROVER', true),
    (3, 'employee01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원01', 'employee01@theieum.local', 3, 1, 'APPLICANT', true),
    (4, 'employee02', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원02', 'employee02@theieum.local', 3, 1, 'APPLICANT', true),
    (5, 'employee03', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원03', 'employee03@theieum.local', 3, 2, 'APPLICANT', true),
    (6, 'employee04', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원04', 'employee04@theieum.local', 3, 2, 'APPLICANT', true),
    (7, 'employee05', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원05', 'employee05@theieum.local', 3, 3, 'APPLICANT', true),
    (8, 'employee06', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원06', 'employee06@theieum.local', 3, 1, 'APPLICANT', true),
    (9, 'employee07', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원07', 'employee07@theieum.local', 4, 1, 'APPLICANT', true),
    (10, 'employee08', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원08', 'employee08@theieum.local', 4, 1, 'APPLICANT', true),
    (11, 'employee09', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원09', 'employee09@theieum.local', 4, 2, 'APPLICANT', true),
    (12, 'employee10', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원10', 'employee10@theieum.local', 4, 2, 'APPLICANT', true),
    (13, 'employee11', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원11', 'employee11@theieum.local', 4, 3, 'APPLICANT', true),
    (14, 'employee12', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '직원12', 'employee12@theieum.local', 4, 1, 'APPLICANT', true),
    (15, 'support01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '지원01', 'support01@theieum.local', 2, 1, 'APPLICANT', true),
    (16, 'support02', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '지원02', 'support02@theieum.local', 2, 2, 'APPLICANT', true),
    (17, 'support03', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '지원03', 'support03@theieum.local', 2, 3, 'APPLICANT', true),
    (18, 'lead-dev', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '개발팀장', 'lead-dev@theieum.local', 3, 4, 'APPROVER,APPLICANT', true),
    (19, 'lead-sales', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '영업팀장', 'lead-sales@theieum.local', 4, 4, 'APPROVER,APPLICANT', true),
    (20, 'ceo', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '대표', 'ceo@theieum.local', 1, 5, 'APPROVER', true),
    (21, 'trial-applicant01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자01', 'trial-applicant01@theieum.local', 2, 1, 'APPLICANT', true),
    (22, 'trial-applicant02', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자02', 'trial-applicant02@theieum.local', 2, 2, 'APPLICANT', true),
    (23, 'trial-applicant03', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자03', 'trial-applicant03@theieum.local', 3, 1, 'APPLICANT', true),
    (24, 'trial-applicant04', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자04', 'trial-applicant04@theieum.local', 3, 2, 'APPLICANT', true),
    (25, 'trial-applicant05', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자05', 'trial-applicant05@theieum.local', 4, 1, 'APPLICANT', true),
    (26, 'trial-applicant06', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험신청자06', 'trial-applicant06@theieum.local', 4, 2, 'APPLICANT', true),
    (27, 'trial-approver01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험결재자01', 'trial-approver01@theieum.local', 2, 4, 'APPROVER,APPLICANT', true),
    (28, 'trial-approver02', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험결재자02', 'trial-approver02@theieum.local', 4, 4, 'APPROVER,APPLICANT', true),
    (29, 'trial-manager01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험매니저01', 'trial-manager01@theieum.local', 1, 5, 'MANAGER,APPROVER,APPLICANT', true),
    (30, 'trial-admin01', null, '$2a$10$8X8CxGxCQq6asM.KWSKYh.rhJaTdPC23Jh8pa7EnojSDCFDIB5xNW', '체험관리자01', 'trial-admin01@theieum.local', 1, 5, 'ADMIN,APPROVER,APPLICANT', true);

insert into approval_lines (id, approval_type_id, name, active) values
    (1, 1, '영수증 첨부 신청 기본 결재선', true);

insert into approval_line_steps (
    id,
    approval_line_id,
    step_order,
    step_type,
    organization_scope,
    position_id,
    direct_user_id,
    sort_policy
) values
    (1, 1, 1, 'DIRECT_USER', null, null, 2, 'POSITION_ORDER'),
    (2, 1, 2, 'ORG_POSITION', 'APPLICANT_ORG', 4, null, 'POSITION_ORDER'),
    (3, 1, 3, 'DIRECT_USER', null, null, 1, 'POSITION_ORDER');

insert into approval_org_exceptions (
    id,
    approval_type_id,
    organization_id,
    approver_user_id,
    step_order,
    active
) values
    (1, 1, 3, 18, 2, true);

select setval(pg_get_serial_sequence('positions', 'id'), (select max(id) from positions));
select setval(pg_get_serial_sequence('organizations', 'id'), (select max(id) from organizations));
select setval(pg_get_serial_sequence('approval_types', 'id'), (select max(id) from approval_types));
select setval(pg_get_serial_sequence('users', 'id'), (select max(id) from users));
select setval(pg_get_serial_sequence('approval_lines', 'id'), (select max(id) from approval_lines));
select setval(pg_get_serial_sequence('approval_line_steps', 'id'), (select max(id) from approval_line_steps));
select setval(pg_get_serial_sequence('approval_org_exceptions', 'id'), (select max(id) from approval_org_exceptions));
