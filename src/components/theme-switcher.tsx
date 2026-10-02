"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
const themes = [
  { value: "light", label: "라이트", Icon: Sun },
  { value: "dark", label: "다크", Icon: Moon },
  { value: "system", label: "시스템", Icon: Monitor },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const CurrentIcon = mounted ? themes.find(item => item.value === theme)?.Icon ?? Monitor : Monitor;
  return <details className="theme-switcher"><summary aria-label="화면 테마 선택" title="화면 테마 선택"><CurrentIcon size={18} aria-hidden="true"/><span className="sr-only">화면 테마 선택</span></summary><div role="group" aria-label="화면 테마">
    {themes.map(({ value, label, Icon }) => <button
      key={value} type="button" aria-label={`${label} 테마`}
      aria-pressed={mounted && theme === value}
      onClick={() => setTheme(value)} title={`${label} 테마`}
    ><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
  </div></details>;
}
