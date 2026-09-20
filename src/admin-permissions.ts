export const PERMISSIONS = {
  editElections: "არჩევნების შექმნა და რედაქტირება",
  controlElections: "პირდაპირ ჩართვა / შეჩერება",
  deleteElections: "არჩევნების წაშლა",
  manageDoctors: "ექიმებისა და კატეგორიების მართვა",
  viewResults: "შედეგების ნახვა და ჩამოტვირთვა",
  publishResults: "საბოლოო დადასტურება / გამოქვეყნება",
  manageAdmins: "ადმინებისა და უფლებების მართვა",
  viewAudit: "აქტივობის ისტორიის ნახვა",
  viewVoterDetails: "ამომრჩევლის ნომრებისა და არჩევანის ნახვა",
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
export type AdminIdentity = { id: number; username: string; name: string; role: string; permissions: Permission[]; active: boolean };
export function allowed(admin: AdminIdentity, permission: Permission) {
  return admin.role === "superadmin" || (admin.role === "manager" && permission === "viewVoterDetails") || admin.permissions.includes(permission);
}
export const ACTION_LABELS: Record<string, string> = {
  create: "არჩევნების შექმნა", "edit-election": "არჩევნების რედაქტირება",
  start: "არჩევნების ჩართვა", stop: "არჩევნების შეჩერება",
  publish: "შედეგების გამოქვეყნება", unpublish: "შედეგების დამალვა",
  "delete-election": "არჩევნების წაშლა", "add-category": "კატეგორიის დამატება",
  "update-category": "კატეგორიის რედაქტირება", "delete-category": "კატეგორიის წაშლა",
  "add-candidate": "ექიმის დამატება", "update-candidate": "ექიმის რედაქტირება",
  "delete-candidate": "ექიმის წაშლა", login: "შესვლა", logout: "გასვლა",
  "save-user": "ადმინის / უფლებების შენახვა", request: "მოთხოვნის გაგზავნა",
  approve: "მოთხოვნის დადასტურება", reject: "მოთხოვნის უარყოფა",
};
export const ACTION_PERMISSION: Record<string, Permission> = {
  create: "editElections", "edit-election": "editElections",
  start: "controlElections", stop: "controlElections", "delete-election": "deleteElections",
  publish: "publishResults", unpublish: "publishResults",
  "add-category": "manageDoctors", "update-category": "manageDoctors", "delete-category": "manageDoctors",
  "add-candidate": "manageDoctors", "update-candidate": "manageDoctors", "delete-candidate": "manageDoctors",
};
