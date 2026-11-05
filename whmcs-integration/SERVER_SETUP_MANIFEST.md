# WHM, CloudLinux LVE & WHMCS Server Provisioning Manifest

This technical manifest contains the exact numerical parameters and automation rules required to configure WHM (`Packages -> Add a Package`), CloudLinux LVE Manager, and WHMCS (`System Settings -> Products/Services`) to deliver sub-second response times, complete account isolation, and instant automated provisioning.

---

## Table A: Exact WHM & CloudLinux LVE Package Limits

Configure these exact package names and limits in **WHM -> Packages -> Add a Package** and mirror them in **CloudLinux LVE Manager -> Packages**:

| Parameter / Configuration Setting | `whm_starter_2gb` (pid: 1) | `whm_devpro_5gb` (pid: 2) | `whm_bizmax_10gb` (pid: 3) |
| :--- | :--- | :--- | :--- |
| **Associated WHMCS Product ID** | `pid: 1` (Starter Pack) | `pid: 2` (Developer Pro) | `pid: 3` (Business Max) |
| **Disk Quota (MB)** | `2048 MB` (2 GB NVMe) | `5120 MB` (5 GB NVMe) | `10240 MB` (10 GB NVMe) |
| **Monthly Bandwidth (MB)** | `102400 MB` (100 GB) | `256000 MB` (250 GB) | `Unlimited` (999999999) |
| **CloudLinux CPU Limit (SPEED)** | `100%` (1 Dedicated Core) | `200%` (2 Dedicated Cores) | `200%` (2 High-Frequency Cores) |
| **Physical Memory (PMEM)** | `1024 MB` (1 GB RAM) | `2048 MB` (2 GB RAM) | `4096 MB` (4 GB RAM) |
| **Disk I/O Limit (IO)** | `25600 KB/s` (25 MB/s) | `51200 KB/s` (50 MB/s) | `102400 KB/s` (100 MB/s) |
| **Disk IOPS** | `1024` IOPS | `2048` IOPS | `4096` IOPS |
| **Concurrent Entry Processes (EP)** | `20` | `40` | `80` |
| **Number of Processes (NPROC)** | `50` | `100` | `150` |
| **Maximum Inode Quota (File Limit)** | `150,000` Inodes | `300,000` Inodes | `600,000` Inodes |
| **Shell Access (SSH)** | `Disabled` (File Manager only) | `Enabled (Jailed Shell)` | `Enabled (Jailed Shell)` |
| **Max Addon Domains** | `0` (1 Primary Website) | `4` (5 Total Websites) | `Unlimited` |
| **Max Subdomains & MySQL DBs** | `10` Each | `Unlimited` | `Unlimited` |
| **Max Email Accounts** | `5` Inboxes | `Unlimited` | `Unlimited` |
| **WHM Feature List** | `default_wp_ai` | `developer_git_nodejs` | `business_full_stack` |
| **cPanel Theme** | `jupiter` | `jupiter` | `jupiter` |

---

## Table B: Exact WHMCS Automation & Cron Settings

Configure these in **WHMCS -> System Settings -> Automation Settings**:

### 1. System Master Cron Job
Add this command to your server crontab (runs every 5 minutes):
```bash
*/5 * * * * php -q /home/yourusername/crons/cron.php
```

### 2. Module Settings (Instant Automated Provisioning)
In **WHMCS -> System Settings -> Products/Services -> Edit Product -> Module Settings**:
- **Module Name:** `cpanel`
- **WHM Package Name:** Match Table A exactly (`whm_starter_2gb`, `whm_devpro_5gb`, `whm_bizmax_10gb`).
- **Provisioning Trigger:** Select **"Automatically setup the product as soon as the first payment is received"**.
- *Result:* When bKash, Nagad, or Stripe webhook verifies payment, WHMCS automatically invokes the WHM XML-API to create the cPanel account, configure CageFS Jailed SSH, and send the welcome email containing credentials in `< 2 seconds`.

### 3. Billing & Invoicing Lifecycle
- **Invoice Generation:** Set to `7 days` before payment due date.
- **Payment Reminders:**
  - Invoice Unpaid Reminder 1: `3 days` before due date.
  - First Overdue Notice: `1 day` after due date.
  - Second Overdue Notice: `2 days` after due date.
- **Automated Suspension:** Enable Suspension after `3 days` overdue (automatically locks cPanel via WHM API).
- **Automated Termination:** Enable Termination after `14 days` overdue (cleans up abandoned disk space and Inodes automatically).

---

## Table C: External Cloud Backup Policy (JetBackup Zero-Local-Quota Rule)

To prevent customer backups from consuming our precious 100GB NVMe reseller storage:

1. In **WHM -> JetBackup 5 -> Destinations -> Add New Destination**:
   - Create an offsite target (e.g. Backblaze B2, AWS S3, or Google Cloud Storage bucket).
2. In **WHM -> JetBackup 5 -> Backup Jobs -> Create New Job**:
   - **Job Type:** Accounts
   - **Destination:** Select the external offsite bucket.
   - **Local Backup Retention:** Set strictly to `0` (Disable local storage).
   - **Schedule:**
     - Starter Pack: Weekly snapshots.
     - Developer Pro: Every 3 days.
     - Business Max: Daily snapshots (retained for 30 days).
3. *Customer Benefit:* 100% of their allocated NVMe quota remains completely free for their application files, build artifacts, and databases.
