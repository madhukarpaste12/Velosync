const USERS_KEY = 'velosync_users';
const SESSION_KEY = 'velosync_session';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  async signup(data) {
    await delay(800); // Simulate network latency
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }

    const newUser = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email,
      password: data.password, // In a real app, this would be hashed on the backend
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { success: true };
  },

  async login(email, password) {
    await delay(800);
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const sessionUser = { id: user.id, name: user.name, email: user.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser() {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
  }
};