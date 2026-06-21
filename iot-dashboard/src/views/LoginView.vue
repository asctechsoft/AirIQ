<template>
  <div class="login-container">
    <div class="login-box">
      <h1>🌬️ IoT Air Quality</h1>
      <p>Hệ thống giám sát chất lượng không khí</p>

      <div class="form-group">
        <input v-model="email" type="email" placeholder="Email" />
      </div>
      <div class="form-group">
        <input v-model="password" type="password" placeholder="Mật khẩu" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button @click="login" :disabled="loading">
        {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import api from "../services/api";

const router = useRouter();
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const login = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });
    localStorage.setItem("token", res.data.token);
    router.push("/dashboard");
  } catch (err) {
    error.value = "Email hoặc mật khẩu không đúng!";
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
</style>
