// auth.js — simple register/login using localStorage
(function(){
    function getUsers(){
        try{ return JSON.parse(localStorage.getItem('users')) || []; }catch(e){ return []; }
    }

    function saveUsers(users){
        localStorage.setItem('users', JSON.stringify(users));
    }

    function setCurrentUser(user){
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateAccountArea();
    }

    function getCurrentUser(){
        try{ return JSON.parse(localStorage.getItem('currentUser')); }catch(e){ return null; }
    }

    function registerUser(e){
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;

        if(!name || !email || !phone || !password){
            showNotification('Please fill all registration fields');
            return;
        }

        const users = getUsers();
        if(users.find(u => u.email === email)){
            showNotification('An account with that email already exists');
            return;
        }

        const user = { id: Date.now(), name, email, phone, password };
        users.push(user);
        saveUsers(users);
        setCurrentUser({ id: user.id, name: user.name, email: user.email, phone: user.phone });
        showNotification('Registration successful — logged in');
        // immediate redirect to products page
        window.location.href = 'products.html';
    }

    function loginUser(e){
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        const users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if(!user){
            showNotification('Invalid email or password');
            return;
        }
        setCurrentUser({ id: user.id, name: user.name, email: user.email, phone: user.phone });
        showNotification('Login successful');
        // immediate redirect to products page
        window.location.href = 'products.html';
    }

    function logoutUser(){
        localStorage.removeItem('currentUser');
        updateAccountArea();
        showNotification('Logged out');
    }

    function updateAccountArea(){
        const accountArea = document.getElementById('accountArea');
        const accountInfo = document.getElementById('accountInfo');
        const logoutBtn = document.getElementById('logoutBtn');
        const current = getCurrentUser();
        if(current){
            if(accountArea) accountArea.style.display = 'block';
            if(accountInfo) accountInfo.innerHTML = `<p><strong>Name:</strong> ${current.name}</p><p><strong>Email:</strong> ${current.email}</p><p><strong>Phone:</strong> ${current.phone}</p>`;
            if(logoutBtn) logoutBtn.addEventListener('click', logoutUser);
            // hide forms
            const regForm = document.getElementById('registerForm');
            const loginForm = document.getElementById('loginForm');
            if(regForm) regForm.style.display = 'none';
            if(loginForm) loginForm.style.display = 'none';
        } else {
            if(accountArea) accountArea.style.display = 'none';
            const regForm = document.getElementById('registerForm');
            const loginForm = document.getElementById('loginForm');
            if(regForm) regForm.style.display = '';
            if(loginForm) loginForm.style.display = '';
        }
    }

    // wire up forms when DOM ready
    document.addEventListener('DOMContentLoaded', function(){
        const regForm = document.getElementById('registerForm');
        const loginForm = document.getElementById('loginForm');
        if(regForm) regForm.addEventListener('submit', registerUser);
        if(loginForm) loginForm.addEventListener('submit', loginUser);
        updateAccountArea();

        // update nav greeting if present
        const greeting = document.getElementById('userGreeting');
        const current = getCurrentUser();
        if(greeting){
            greeting.textContent = current ? `Hi, ${current.name}` : 'Login';
        }
    });

})();
