import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { base } from '../../api/http';

export default function OAuth2Callback() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const urlToken = searchParams.get('token');

        if (urlToken) {
          // Parse JWT claims
          let userId = '0';
          let email = '';
          let userType = 'Patient';
          try {
            const payloadBase64 = urlToken.split('.')[1];
            const decodedJson = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            userId = String(decodedJson.userId || '');
            email = String(decodedJson.sub || '');
            userType = String(decodedJson.role || 'Patient');
          } catch {
            // ignore parse error
          }

          // Try fetching user profile from /users/me
          try {
            const meRes = await fetch(`${base}/users/me`, {
              headers: { Authorization: `Bearer ${urlToken}` },
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              const u = meData.data;
              login(
                {
                  id: String(u.id),
                  fullName: u.fullName || email,
                  email: u.email || email,
                  userType: u.userType || userType,
                },
                urlToken
              );
              navigate('/', { replace: true });
              return;
            }
          } catch {
            // fallback below
          }

          login(
            {
              id: userId,
              fullName: email,
              email: email,
              userType: userType as any,
            },
            urlToken
          );
          navigate('/', { replace: true });
          return;
        }

        const backendBase = base;
        
        const res = await fetch(`${backendBase}/auth/oauth2/user-info`, {
          method: 'GET',
          credentials: 'include', // Quan trọng: gửi session cookie từ OAuth2
          headers: { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('OAuth2 user-info failed:', res.status, errorText);
          throw new Error(`OAuth2 user-info failed: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data?.token || !data?.user) {
          console.error('Invalid OAuth2 response:', data);
          throw new Error('Invalid OAuth2 response: missing token or user');
        }
        
        login(
          {
            id: String(data.user.id),
            fullName: data.user.fullName,
            email: data.user.email,
            userType: data.user.userType,
          },
          data.token
        );
        navigate('/', { replace: true });
      } catch (error) {
        console.error('OAuth2 callback error:', error);
        navigate('/login', { replace: true });
      }
    })();
  }, [login, navigate]);

  return null;
}


