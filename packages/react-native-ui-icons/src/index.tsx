import * as React from "react";
import type { SvgProps } from "react-native-svg";
import ArrowRightSource from "./icons/arrow-right-cc.svg";
import BackSource from "./icons/back-cc.svg";
import CaretDownSource from "./icons/caret-down-cc.svg";
import CheckSource from "./icons/check-cc.svg";
import CloseSource from "./icons/close-cc.svg";
import CodeSource from "./icons/code-cc.svg";
import CopySource from "./icons/copy-cc.svg";
import DeleteSource from "./icons/delete-cc.svg";
import DocumentSource from "./icons/document-cc.svg";
import EditSource from "./icons/edit-cc.svg";
import ExternalLinkSource from "./icons/external-link-cc.svg";
import EyeClosedSource from "./icons/eye-closed-cc.svg";
import EyeSource from "./icons/eye-cc.svg";
import ForwardSource from "./icons/forward-cc.svg";
import GlobeSource from "./icons/globe-cc.svg";
import HomeSource from "./icons/home-cc.svg";
import InfoSource from "./icons/info-cc.svg";
import LicenseSource from "./icons/license-cc.svg";
import LockSource from "./icons/lock-cc.svg";
import MoreSource from "./icons/more-cc.svg";
import PlusSource from "./icons/plus-cc.svg";
import QrCodeSource from "./icons/qr-code-cc.svg";
import ReceiveSource from "./icons/receive-cc.svg";
import RefreshSource from "./icons/refresh-cc.svg";
import SearchSource from "./icons/search-cc.svg";
import SendSource from "./icons/send-cc.svg";
import SettingsSource from "./icons/settings-cc.svg";
import ShieldSource from "./icons/shield-cc.svg";
import StarSource from "./icons/star-cc.svg";
import SwapSource from "./icons/swap-cc.svg";
import TagSource from "./icons/tag-cc.svg";
import TabsSource from "./icons/tabs-cc.svg";
import ThemeDarkSource from "./icons/theme-dark-cc.svg";
import ThemeLightSource from "./icons/theme-light-cc.svg";
import ThemeModeSource from "./icons/theme-mode-cc.svg";
import ThemeSystemSource from "./icons/theme-system-cc.svg";
import WalletSource from "./icons/wallet-cc.svg";

export type RubanIconProps = SvgProps & {
  size?: number;
};

type IconSource = React.ComponentType<SvgProps>;

function createIcon(Source: IconSource, displayName: string) {
  function RubanIcon({
    size = 24,
    width = size,
    height = size,
    ...props
  }: RubanIconProps): React.ReactElement {
    return <Source width={width} height={height} {...props} />;
  }

  RubanIcon.displayName = displayName;
  return React.memo(RubanIcon);
}

export const ArrowRightIcon = createIcon(ArrowRightSource, "ArrowRightIcon");
export const BackIcon = createIcon(BackSource, "BackIcon");
export const CaretDownIcon = createIcon(CaretDownSource, "CaretDownIcon");
export const CheckIcon = createIcon(CheckSource, "CheckIcon");
export const CloseIcon = createIcon(CloseSource, "CloseIcon");
export const CodeIcon = createIcon(CodeSource, "CodeIcon");
export const CopyIcon = createIcon(CopySource, "CopyIcon");
export const DeleteIcon = createIcon(DeleteSource, "DeleteIcon");
export const DocumentIcon = createIcon(DocumentSource, "DocumentIcon");
export const EditIcon = createIcon(EditSource, "EditIcon");
export const ExternalLinkIcon = createIcon(
  ExternalLinkSource,
  "ExternalLinkIcon"
);
export const EyeClosedIcon = createIcon(EyeClosedSource, "EyeClosedIcon");
export const EyeIcon = createIcon(EyeSource, "EyeIcon");
export const ForwardIcon = createIcon(ForwardSource, "ForwardIcon");
export const GlobeIcon = createIcon(GlobeSource, "GlobeIcon");
export const HomeIcon = createIcon(HomeSource, "HomeIcon");
export const InfoIcon = createIcon(InfoSource, "InfoIcon");
export const LicenseIcon = createIcon(LicenseSource, "LicenseIcon");
export const LockIcon = createIcon(LockSource, "LockIcon");
export const MoreIcon = createIcon(MoreSource, "MoreIcon");
export const PlusIcon = createIcon(PlusSource, "PlusIcon");
export const QrCodeIcon = createIcon(QrCodeSource, "QrCodeIcon");
export const ReceiveIcon = createIcon(ReceiveSource, "ReceiveIcon");
export const RefreshIcon = createIcon(RefreshSource, "RefreshIcon");
export const SearchIcon = createIcon(SearchSource, "SearchIcon");
export const SendIcon = createIcon(SendSource, "SendIcon");
export const SettingsIcon = createIcon(SettingsSource, "SettingsIcon");
export const ShieldIcon = createIcon(ShieldSource, "ShieldIcon");
export const StarIcon = createIcon(StarSource, "StarIcon");
export const SwapIcon = createIcon(SwapSource, "SwapIcon");
export const TagIcon = createIcon(TagSource, "TagIcon");
export const TabsIcon = createIcon(TabsSource, "TabsIcon");
export const ThemeDarkIcon = createIcon(ThemeDarkSource, "ThemeDarkIcon");
export const ThemeLightIcon = createIcon(ThemeLightSource, "ThemeLightIcon");
export const ThemeModeIcon = createIcon(ThemeModeSource, "ThemeModeIcon");
export const ThemeSystemIcon = createIcon(ThemeSystemSource, "ThemeSystemIcon");
export const WalletIcon = createIcon(WalletSource, "WalletIcon");
