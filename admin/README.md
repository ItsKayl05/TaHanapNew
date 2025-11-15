# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Render / Production quick setup (Admin)

Follow these steps to ensure the Admin UI can call your backend when deployed on Render (or similar hosts):

1. Set `VITE_API_BASE_URL` in the Admin service environment (Render > Service > Environment):
	- Example: `https://api.tahanap.xyz` or your backend render URL `https://<your-backend>.onrender.com`
	- Important: Vite reads env variables at build time. After setting this, redeploy the Admin service.

2. Set backend environment variables in the Backend service (Render > Service > Environment):
	- `ALLOWED_ORIGINS` (comma-separated) - include your admin domain(s) and frontend domains:
	  `https://tahanap-admin-o398.onrender.com,https://tahanap.xyz,https://api.tahanap.xyz`
	- `DEBUG_TOKEN` (optional) - a secure token to use debug endpoints (if enabled).

3. Redeploy both Admin and Backend services.

4. Test login from the Admin UI (open Browser devtools Console): you should see console logs like:
	- `🔐 Admin login attempt: { username: 'admin', url: 'https://api.tahanap.xyz/api/auth/admin/login' }`
	- `✅ Admin login response: { status: 200, data: { msg: 'Admin login successful', token: '...', role: 'admin' } }`

5. (Optional) Use the debug endpoint to inspect user role (temporary):
	- `GET https://api.tahanap.xyz/api/admin/debug/user/admin` with header `x-debug-token: <DEBUG_TOKEN>`

Security note: do not commit production secrets to the repository. Use Render's environment variable UI to manage secrets securely. Remove debug endpoints after troubleshooting.
