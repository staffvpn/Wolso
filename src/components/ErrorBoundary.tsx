import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from './ui/Button';
import { Logo } from './ui/Logo';

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
}

/** Nothing upstream of this catches a render-time exception — without it,
 *  React unmounts the whole tree on any uncaught throw and leaves the
 *  Telegram WebView showing literally nothing: no error, no spinner, just
 *  the page's own dark background behind the native "Закрыть" chrome. A
 *  bug that would otherwise be a silent black screen becomes a readable
 *  message with a way back in. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render crash caught by ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-5 text-center safe-top safe-bottom">
        <Logo size={28} className="text-accent" />
        <div className="space-y-1.5">
          <p className="font-bold text-[16px]">Что-то пошло не так</p>
          <p className="text-[14px] text-text-muted max-w-[280px]">Попробуйте перезапустить приложение.</p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RotateCw size={16} /> Перезагрузить
        </Button>
      </div>
    );
  }
}
