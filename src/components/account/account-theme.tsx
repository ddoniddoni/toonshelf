"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";
export function AccountTheme({theme}: {theme:"system"|"light"|"dark"}) {
  const {setTheme} = useTheme();
  useEffect(() => { setTheme(theme); },[theme,setTheme]);
  return null;
}
