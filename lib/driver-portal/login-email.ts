export function buildDriverPortalLoginEmail(code: string) {
  return {
    subject: "Tripetica Şoför girişi doğrulama kodu",
    text: `Tripetica Şoför Portalı giriş kodunuz: ${code}\n\nKod 10 dakika geçerlidir ve tek kullanımlıktır. Bu işlemi siz başlatmadıysanız bu e-postayı yok sayın.`,
  };
}
