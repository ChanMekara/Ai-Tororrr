import { createHashRouter, RouterProvider } from 'react-router-dom';
import Chat from './pages/Chat';
import SettingsPage from './pages/SettingsPage';

const router = createHashRouter([
  { path: '/', element: <Chat /> },
  { path: '/settings', element: <SettingsPage /> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
