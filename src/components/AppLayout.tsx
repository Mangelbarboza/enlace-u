import { NavLink, Outlet } from 'react-router'
import { GraduationCap, Home, MessageCircle, Store, User } from 'lucide-react'

const navItems = [
  {
    label: 'Perfil',
    path: '/perfil',
    icon: User,
  },
  {
    label: 'Muro U',
    path: '/muro-u',
    icon: GraduationCap,
  },
  {
    label: 'General',
    path: '/',
    icon: Home,
  },
  {
    label: 'Market',
    path: '/market',
    icon: Store,
  },
  {
    label: 'Chats',
    path: '/chats',
    icon: MessageCircle,
  },
]

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white p-4 md:block">
        <h1 className="mb-6 text-xl font-black">Enlace U</h1>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                <Icon size={20} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-5 md:ml-64 md:max-w-3xl md:px-8 md:pb-8">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t bg-white md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs',
                  isActive ? 'text-slate-950' : 'text-slate-400',
                ].join(' ')
              }
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}