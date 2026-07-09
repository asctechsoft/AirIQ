<template>
  <div class="login-container">
    <div class="login-box">
      <img :src="logo" class="auth-logo" alt="AirIQ" />
      <h1>Chất lượng không khí IOT</h1>

      <form @submit.prevent="login">
        <div class="form-group">
          <input v-model="email" type="email" placeholder="Email" autocomplete="username" />
        </div>
        <div class="form-group">
          <input v-model="password" type="password" placeholder="Mật khẩu" autocomplete="current-password" />
        </div>

        <p v-if="success" class="success">{{ success }}</p>
        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
        </button>
      </form>

      <p class="switch-link">
        Chưa có tài khoản?
        <RouterLink to="/register">Đăng ký</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import api from "../services/api";
import logo from "../assets/logo.jpg";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const error = ref("");
const success = ref(route.query.registered ? "Đăng ký thành công! Vui lòng đăng nhập." : "");
const loading = ref(false);

const login = async () => {
  error.value = "";
  success.value = "";

  if (!EMAIL_REGEX.test(email.value.trim())) {
    error.value = "Email không đúng định dạng!";
    return;
  }

  loading.value = true;
  try {
    const res = await api.post("/auth/login", {
      email: email.value.trim(),
      password: password.value,
    });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    router.push("/dashboard");
  } catch (err) {
    error.value = err.response?.data?.message || "Email hoặc mật khẩu không đúng!";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
}
.login-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  width: 360px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.auth-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  margin: 0 auto 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}
h1 {
  color: #1a73e8;
  margin-bottom: 8px;
}
p {
  color: #666;
  margin-bottom: 24px;
}
.form-group {
  margin-bottom: 16px;
}
input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}
button {
  width: 100%;
  padding: 12px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 8px;
}
button:hover {
  background: #1557b0;
}
button:disabled {
  background: #aaa;
  cursor: not-allowed;
}
.error {
  color: red;
  font-size: 13px;
  margin-bottom: 8px;
}
.success {
  color: #059669;
  font-size: 13px;
  margin-bottom: 8px;
}
.switch-link {
  margin: 20px 0 0;
  font-size: 13px;
  color: #666;
}
.switch-link a {
  color: #1a73e8;
  font-weight: 600;
  text-decoration: none;
}
.switch-link a:hover {
  text-decoration: underline;
}
</style>
