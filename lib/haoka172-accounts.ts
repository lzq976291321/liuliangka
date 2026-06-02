import accountsConfig from "@/config/haoka172-accounts.json";

export type Haoka172Account = {
  id: string;
  name: string;
  productUserId: string;
  productSecret: string;
  orderUserId: string;
  productId?: string;
};

type Haoka172AccountsConfig = {
  defaultAccountId: string;
  accounts: Haoka172Account[];
};

export function isPlaceholderHaoka172Secret(value?: string) {
  return !value || /\*|REPLACE_WITH_|REDACT|hidden/i.test(value);
}

function isValidAccount(account: Partial<Haoka172Account> | undefined): account is Haoka172Account {
  return Boolean(account?.id && account.name && account.productUserId && account.productSecret && account.orderUserId);
}

export function getHaoka172AccountsConfig() {
  return accountsConfig as Haoka172AccountsConfig;
}

export function getHaoka172Account(accountId?: string) {
  const config = getHaoka172AccountsConfig();
  const targetAccountId = accountId || config.defaultAccountId;
  const account = config.accounts.find((item) => item.id === targetAccountId);

  if (!isValidAccount(account)) {
    throw new Error(`172 账号配置无效：${targetAccountId}`);
  }

  return account;
}

export function getDefaultHaoka172Account() {
  return getHaoka172Account();
}
