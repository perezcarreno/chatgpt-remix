#!/bin/sh

# This file is how Fly starts the server (configured in fly.toml). Before starting
# the server though, we need to run any prisma migrations that haven't yet been
# run, which is why this file exists in the first place.
# Learn more: https://community.fly.io/t/sqlite-not-getting-setup-properly/4386

set -ex

# Setup 512MB of space for swap and set permissions and turn on swapmode
fallocate -l 512M /swapfile
chmod 0600 /swapfile
mkswap /swapfile
echo 10 > /proc/sys/vm/swappiness
swapon /swapfile

# Run migrations
npx prisma migrate deploy

# Turn off swap mode and remove swap directory
swapoff /swapfile
rm /swapfile

# Finally start the app
npm run start