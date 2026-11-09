import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { I18nProvider, PublicLang, useI18n } from './lib/i18n';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './lib/toast';
import { Spinner } from './components/ui';
import { Landing } from './pages/Landing';

const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const GamesIndex = lazy(() => import('./pages/GamesIndex'));
const Legal = lazy(() => import('./pages/Legal'));
const GameGuide = lazy(() => import('./pages/GameGuide'));
const NewGame = lazy(() => import('./pages/NewGame'));
const Game = lazy(() => import('./pages/Game'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Loading() {
  const { t } = useI18n();
  return (
    <div className="felt grid min-h-dvh place-items-center">
      <Spinner label={t('loading')} onFelt />
    </div>
  );
}

function RequireUser({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <SessionProvider>
          <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<PublicLang lang="tr"><Landing /></PublicLang>} />
                <Route path="/login" element={<Login />} />
                <Route path="/oyunlar" element={<PublicLang lang="tr"><GamesIndex /></PublicLang>} />
                <Route path="/oyun/:slug" element={<PublicLang lang="tr"><GameGuide /></PublicLang>} />
                <Route path="/yasal" element={<PublicLang lang="tr"><Legal /></PublicLang>} />
                <Route path="/en" element={<PublicLang lang="en"><Landing /></PublicLang>} />
                <Route path="/en/games" element={<PublicLang lang="en"><GamesIndex /></PublicLang>} />
                <Route path="/en/games/:slug" element={<PublicLang lang="en"><GameGuide /></PublicLang>} />
                <Route path="/en/legal" element={<PublicLang lang="en"><Legal /></PublicLang>} />
                <Route
                  path="/app"
                  element={
                    <RequireUser>
                      <Home />
                    </RequireUser>
                  }
                />
                <Route
                  path="/new"
                  element={
                    <RequireUser>
                      <NewGame />
                    </RequireUser>
                  }
                />
                <Route
                  path="/g/:ref"
                  element={
                    <RequireUser>
                      <Game />
                    </RequireUser>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SessionProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
