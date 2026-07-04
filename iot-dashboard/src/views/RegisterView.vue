<template>
  <div class="login-container">
    <div class="login-box">
      <h1>🌬️ IoT Air Quality</h1>
      <p>Tạo tài khoản mới</p>

      <form @submit.prevent="register">
        <div class="form-group">
          <input v-model="email" type="email" placeholder="Email" autocomplete="username" />
        </div>
        <div class="form-group">
          <input v-model="password" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <input v-model="confirmPassword" type="password" placeholder="Nhập lại mật khẩu" autocomplete="new-password" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? "Đang đăng ký..." : "Đăng ký" }}
        </button>
      </form>

      <p class="switch-link">
        Đã có tài khoản?
        <RouterLink to="/login">Đăng nhập</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import api from "../services/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = useRouter();
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const error = ref("");
const loading = ref(false);

const register = async () => {
  error.value = "";

  if (!EMAIL_REGEX.test(email.value.trim())) {
    error.value = "Email không đúng định dạng!";
    return;
  }
  if (password.value.length < 6) {
    error.value = "Mật khẩu phải có ít nhất 6 ký tự!";
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = "Mật khẩu nhập lại không khớp!";
    return;
  }

  loading.value = true;
  try {
    await api.post("/auth/register", {
      email: email.value.trim(),
      password: password.value,
    });
    router.push({ path: "/login", query: { registered: "1" } });
  } catch (err) {
    error.value = err.response?.data?.message || "Đăng ký thất bại, thử lại sau!";
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
