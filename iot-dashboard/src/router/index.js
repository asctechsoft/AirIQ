import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/login", component: LoginView },
    {
      path: "/dashboard",
      component: DashboardView,
      beforeEnter: (to, from, next) => {
        if (!localStorage.getItem("token")) next("/login");
        else next();
      },
    },
  ],
});

export default router;
