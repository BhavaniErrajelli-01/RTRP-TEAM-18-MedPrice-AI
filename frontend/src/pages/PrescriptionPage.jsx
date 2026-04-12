import React, { useMemo, useState } from 'react';
import { FileText, Loader2, ScanSearch, ShieldAlert, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { savePrescription } from '../services/supabaseData';

const PrescriptionPage = ({ user, onRequireSignIn }) => {
    const navigate = useNavigate();
    const [selectedFile, setSelectedFile] = useState(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [saving, setSaving] = useState(false);

    const extractedMedicines = useMemo(
        () => analysis?.extracted_medicines || [],
        [analysis]
    );

    const openCompare = (medicine) => {
        navigate(`/?prescription_query=${encodeURIComponent(medicine)}`);
    };

    const handleAnalyze = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setError('Please choose a prescription image, PDF, or text file first.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');

        try {
            const response = await api.analyzePrescription(selectedFile, notes);
            setAnalysis(response);
            setNotice(
                response.message ||
                (response.isFallback
                    ? 'Showing local starter extraction for now.'
                    : 'Prescription analyzed successfully.')
            );
        } catch (analysisError) {
            setError(analysisError.message || 'Unable to analyze the prescription right now.');
            setAnalysis(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePrescription = async () => {
        if (!user) {
            onRequireSignIn?.();
            return;
        }

        if (!analysis) {
            setError('Analyze the prescription before saving it.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await savePrescription({
                fileName: analysis.file_name,
                notes: analysis.notes,
                extractedMedicines,
                ocrStatus: analysis.ocr_status,
                rawTextPreview: analysis.raw_text_preview,
            });
            setNotice('Prescription saved successfully.');
        } catch (saveError) {
            setError(saveError.message || 'Unable to save the prescription right now.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-16">
            <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f6fbff_50%,#fff8ef_100%)] px-6 py-10 shadow-sm sm:px-8">
                <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                        <ScanSearch size={14} />
                        Prescription Upload
                    </div>
                    <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                        Upload a prescription and review detected medicines
                    </h1>
                    <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                        This first version supports prescription upload analysis in starter mode. Review the detected medicines, save the prescription, and compare medicines one by one.
                    </p>
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <form onSubmit={handleAnalyze} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-900">Upload your prescription</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Use an image, PDF, or text file. OCR is starter-mode for now, so please review extracted medicines carefully before acting on them.
                    </p>

                    <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/40">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
                            <UploadCloud size={24} />
                        </span>
                        <span className="mt-4 text-base font-semibold text-slate-900">
                            {selectedFile ? selectedFile.name : 'Choose a prescription file'}
                        </span>
                        <span className="mt-2 text-sm text-slate-500">PNG, JPG, PDF, or TXT</span>
                        <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.pdf,.txt"
                            className="hidden"
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                    </label>

                    <div className="mt-5">
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Notes for extraction</label>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Optional: add known medicine names or notes to help review"
                            rows={4}
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!selectedFile || loading}
                        className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="mr-2 animate-spin" />
                                Analyzing prescription...
                            </>
                        ) : (
                            'Analyze Prescription'
                        )}
                    </button>
                </form>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-900">Review detected medicines</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        We’ll show the extracted medicines here so you can review them before searching or saving.
                    </p>

                    {error ? (
                        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                            {notice}
                        </div>
                    ) : null}

                    {analysis ? (
                        <div className="mt-6 space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{analysis.file_name}</p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{analysis.ocr_status}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                        {analysis.content_type}
                                    </span>
                                </div>
                                {analysis.raw_text_preview ? (
                                    <p className="mt-3 text-sm leading-6 text-slate-600">{analysis.raw_text_preview}</p>
                                ) : null}
                            </div>

                            <div>
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FileText size={16} />
                                    Extracted medicines
                                </div>
                                <div className="space-y-3">
                                    {extractedMedicines.length ? (
                                        extractedMedicines.map((medicine) => (
                                            <div key={medicine} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{medicine}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Review medicine spelling and dosage before comparing.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => openCompare(medicine)}
                                                    className="rounded-full border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                                                >
                                                    Compare
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                                            No medicines were confidently extracted yet. Try a clearer prescription image or add notes.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                                <div className="flex items-start gap-2">
                                    <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
                                    <p>
                                        Prescription OCR is in starter mode. Please verify medicine names and dosages before placing an order or considering substitutes.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSavePrescription}
                                disabled={saving || !analysis}
                                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Prescription'}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                            Upload a prescription to start the extraction and review flow.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default PrescriptionPage;
