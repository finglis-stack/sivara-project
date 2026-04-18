import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
      <SelectTrigger className="w-fit h-9 bg-transparent border-none text-[#111111] font-light text-sm shadow-none focus:ring-0">
        <div className="flex items-center gap-2">
          <img src="/ca-flag.png" alt="CA" className="w-4 h-auto object-contain rounded-[2px]" />
          <span>{language === 'fr-CA' ? 'FR-CA' : 'EN-CA'}</span>
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="fr-CA" className="text-sm font-light text-[#111111] cursor-pointer">
            <span className="flex items-center gap-2">
                <img src="/ca-flag.png" alt="CA" className="w-4 h-auto object-contain rounded-[2px]" />
                Français (CA)
            </span>
        </SelectItem>
        <SelectItem value="en-CA" className="text-sm font-light text-[#111111] cursor-pointer">
            <span className="flex items-center gap-2">
                <img src="/ca-flag.png" alt="CA" className="w-4 h-auto object-contain rounded-[2px]" />
                English (CA)
            </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default LanguageSelector;
