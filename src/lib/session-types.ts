/** The logged-in user as the browser sees it (never contains secrets). */
export type LocalUser = {
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  pinEnabled?: boolean;
  mustChangePassword?: boolean;
};
