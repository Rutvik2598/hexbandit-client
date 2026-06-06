import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import QueryProvider from './app/providers/QueryProvider';
import HomePage from './pages/home/HomePage';
import LobbyPage from './pages/lobby/LobbyPage';
import GamePage from './pages/game/GamePage';
import SpectatorPage from './pages/spectator/SpectatorPage';
import { ToastContainer } from './shared/components/ToastContainer';

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/spectate/:gameId" element={<SpectatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </QueryProvider>
  );
}

export default App;
