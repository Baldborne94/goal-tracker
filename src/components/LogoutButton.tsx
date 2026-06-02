"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-[#4a3a7a] hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-950/20"
    >
      Leave realm
    </button>
  );
}
