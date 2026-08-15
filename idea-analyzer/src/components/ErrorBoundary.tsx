import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled render error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-8 gap-3 text-center safe-top safe-bottom">
          <p className="font-bold text-[16px]">Что-то пошло не так</p>
          <p className="text-[14px] text-text-muted">Перезапустите приложение</p>
        </div>
      );
    }
    return this.props.children;
  }
}
