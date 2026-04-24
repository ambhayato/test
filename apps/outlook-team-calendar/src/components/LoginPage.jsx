import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

export default function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(console.error);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">📅</div>
        <h1>チームカレンダービューアー</h1>
        <p>Outlookのチームメンバーの予定をまとめて確認できます</p>
        <button className="btn btn-primary btn-large" onClick={handleLogin}>
          Microsoftアカウントでサインイン
        </button>
        <p className="login-note">
          Azure AD管理者の承認が必要な場合があります
        </p>
      </div>
    </div>
  );
}
