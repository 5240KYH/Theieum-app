alter table organizations
    add column leader_user_id bigint references users (id);

