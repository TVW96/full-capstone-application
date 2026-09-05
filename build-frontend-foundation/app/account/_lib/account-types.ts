export type AccountAddress = {
  addressId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  administrativeArea: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AccountUser = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  region: string;
  avatarUrl: string | null;
  bio: string | null;
  addresses: AccountAddress[];
  createdAt: string;
  updatedAt: string;
};

export type AccountActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
};
