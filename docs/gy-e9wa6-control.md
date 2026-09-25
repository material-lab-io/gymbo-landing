# CONTROL PR for gy-e9wa6 (DO NOT MERGE)

This file exists only so a real, open pull request can carry the `deploy-authorization-pending`
and `deploy-authorization-test` labels while the hourly Deploy Authorisation Watch is observed:

- NEGATIVE control: scheduled runs in the first hour after the pending label must be GREEN.
- POSITIVE control: the first scheduled run after the PR is over an hour old must be RED
  (`::error::OVERDUE`), and the async-watchdog must page.

The PR is closed and its branch deleted as soon as both signs are recorded on gy-e9wa6.
It changes no site file and must never be merged.
