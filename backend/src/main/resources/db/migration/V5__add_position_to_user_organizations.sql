alter table user_organizations
    add column position_id bigint;

update user_organizations uo
set position_id = u.position_id
from users u
where u.id = uo.user_id;

alter table user_organizations
    alter column position_id set not null;

alter table user_organizations
    add constraint fk_user_organizations_position
    foreign key (position_id)
    references positions (id);

create index ix_user_organizations_position
    on user_organizations (position_id);
