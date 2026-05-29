import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import QueryProvider from './app/providers/QueryProvider';
import LobbyPage from './pages/lobby/LobbyPage';
import GamePage from './pages/game/GamePage';

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;
