import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, LogIn, LogOut } from 'lucide-react';

const navItems = [
    { label: 'Prescription', to: '/prescriptions' },
    { label: 'Medi Savings', to: '/medi-savings' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'About Us', to: '/about-us' },
    { label: 'FAQ', to: '/faq' },
];

const Navbar = ({ user, onOpenSignIn, onSignOut }) => {
    const navigate = useNavigate();

    const handleHomeClick = (event) => {
        event.preventDefault();
        navigate('/');
        window.dispatchEvent(new CustomEvent('medprice-reset-home'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSectionClick = (path) => {
        navigate(path);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-4 lg:gap-8">
                    <Link
                        to="/"
                        onClick={handleHomeClick}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-base font-black tracking-tight text-white transition hover:bg-slate-800"
                    >
                        MedPrice
                    </Link>

                    <div className="hidden items-center gap-2 md:flex">
                        {navItems.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => handleSectionClick(item.to)}
                                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => handleSectionClick('/prescriptions')}
                        className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex"
                    >
                        <FileText size={15} />
                        Upload Prescription
                    </button>

                    {user ? (
                        <button
                            type="button"
                            onClick={onSignOut}
                            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                <LogOut size={15} />
                            </span>
                            Sign Out
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onOpenSignIn}
                            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(14,165,233,0.28)]"
                        >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                                <LogIn size={15} />
                            </span>
                            Sign In
                            <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
