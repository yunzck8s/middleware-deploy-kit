#!/bin/bash

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请以 root 用户运行此脚本"
  exit 1
fi

tar -zxvf package/openssh-10.0p2.tar.gz
cd openssh-10.0p1
./configure --prefix=/usr --sysconfdir=/etc/ssh --with-pam
make -j"$(nproc)"
make install

echo "*************************** 编译完成 ***************************"



echo "*************************** 开始配置OpenSSH ***************************"

sudo sed -i 's/^GSSAPIKexAlgorithms/#GSSAPIKexAlgorithms/' /etc/crypto-policies/back-ends/opensshserver.config
sudo sed -i 's/^GSSAPI/#GSSAPI/' /etc/ssh/sshd_config.d/50-redhat.conf
sudo sed -i 's/^GSSAPI/#GSSAPI/' /etc/crypto-policies/back-ends/openssh.config

sudo chmod 600 /etc/ssh/ssh_host_rsa_key
sudo chmod 600 /etc/ssh/ssh_host_ecdsa_key
sudo chmod 600 /etc/ssh/ssh_host_ed25519_key

systemctl restart sshd

echo "***************************升级OpenSSH完成***************************"
