import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/global.css';
import './styles/tokens.css';
import 'bootstrap/dist/css/bootstrap.min.css';
// import dotenv from 'dotenv'

// dotenv.config({ path: '../.env' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
