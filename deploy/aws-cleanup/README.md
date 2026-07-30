# AWS cleanup toolkit

Read-only auditing and a restore point, for the "what is AWS charging for and
what can be deleted" exercise. **Nothing in here deletes anything** — deletions
are done by a human in the AWS Console, deliberately, because the app's
instance role (`gwaveAppEc2Role`) should never hold destructive rights: if the
web app is ever compromised, the blast radius should not include the
infrastructure.

## Use it

On the app EC2 box:

```bash
curl -fsSL https://raw.githubusercontent.com/KoNyein/gwave.ai/main/deploy/aws-cleanup/gwave-restore-point.sh -o restore.sh
bash restore.sh          # records state + pg_dump; creates nothing in AWS

curl -fsSL https://raw.githubusercontent.com/KoNyein/gwave.ai/main/deploy/aws-cleanup/aws-audit.sh -o audit.sh
bash audit.sh | tee audit.txt
```

Then follow `RESTORE.md` for the three Console snapshots, and only delete after
they report `available`.

## Production facts these scripts assume

| | |
|---|---|
| App server | EC2 `i-0207c3c6180868996` · ap-southeast-1 (`APP_INSTANCE_ID` in deploy.yml) |
| Public IP | `18.139.214.180` — gwave.cc and www.gwave.cc both resolve straight to it |
| Load balancer | none: DNS points at the box, so any ELB on the bill is not serving the site |
| Database | RDS `gwave-db…ap-southeast-1.rds.amazonaws.com`, database `gwave` |
| Registry | ECR `gwave-web`, account `150897468627` |
| Real user pool | Cognito `ap-southeast-1_krSbdHFs9` (`gwave-users`) |

Anything not in that table is a candidate for review — but review it, don't
assume.
