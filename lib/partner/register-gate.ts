export function partnerRegisterUiPhase(input: {
  currentEmail: string;
  verifiedEmail: string;
  challengeEmail: string;
  codeSent: boolean;
}) {
  const email = input.currentEmail.trim().toLowerCase();
  const emailVerified = input.verifiedEmail !== "" && email === input.verifiedEmail;
  const sentForCurrent = input.codeSent && input.challengeEmail === email;
  return {
    emailVerified,
    showSend: !emailVerified,
    showCode: sentForCurrent && !emailVerified,
    showForm: emailVerified,
  };
}
