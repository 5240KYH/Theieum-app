alter table application_approval_steps
    add column approval_organization_id bigint references organizations (id),
    add column approval_position_id bigint references positions (id);

update application_approval_steps step
set approval_organization_id = users.organization_id,
    approval_position_id = users.position_id
from users
where users.id = step.original_approver_id
  and step.approval_organization_id is null;

alter table application_approval_steps
    alter column approval_organization_id set not null,
    alter column approval_position_id set not null;
