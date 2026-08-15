"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { apiFetch, errorMessage } from "../_lib/api";

type LoginResult = {
  token: string;
  user: { id: number; email: string; fullName: string; role: "owner" | "cashier" | "stock" };
};

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<LoginResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      window.sessionStorage.setItem("authToken", result.token);
      window.sessionStorage.setItem("authUser", JSON.stringify(result.user));
      window.location.assign("/");
    } catch (loginError) {
      setError(errorMessage(loginError));
      setLoading(false);
    }
  };

  return <main className="login-screen">
    <form className="login-card" onSubmit={login}>
      <h1>CAPTAIN GAI SOD</h1>
      <label>อีเมล<div className="login-input"><input name="email" type="email" required defaultValue="captain@gmail.com" /></div></label>
      <label>รหัสผ่าน<div className="login-input"><input name="password" type={showPassword ? "text" : "password"} required defaultValue="captain123"/><button type="button" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Eye size={16}/> : <EyeOff size={16}/>}</button></div></label>
      {error && <div className="form-error">{error}</div>}
      <button className="login-submit" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
    </form>
  </main>;
}
